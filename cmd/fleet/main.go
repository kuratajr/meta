package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

)

// --- Shared Types ---

type NodeInfo struct {
	Hostname string    `json:"hostname"`
	CPU      float64   `json:"cpu"`
	RAM      float64   `json:"ram"`
	Disk     float64   `json:"disk"`
	Uptime   string    `json:"uptime"`
	IP       string    `json:"ip,omitempty"`
	LastSeen time.Time `json:"last_seen"`
	Secret   string    `json:"secret,omitempty"` // Only for Agent -> Hub
}

// --- Hub Implementation ---

var (
	nodes     = make(map[string]NodeInfo)
	nodesMu   sync.Mutex
)

func runHub(udpPort, httpPort, interval int, hubSecret, agentSecret string, debug bool) {
	log.Printf("MODE: HUB STARTING...")
	log.Printf("UDP Listener: :%d (Expecting Secret: %s)", udpPort, maskSecret(agentSecret))
	log.Printf("HTTP Stream:   :%d/stream (Secret: %s)", httpPort, maskSecret(hubSecret))
	log.Printf("Settings:      Batch Cleanup=%ds, Debug=%v", interval, debug)

	// 1. UDP Listener for Agents
	go func() {
		addr := net.UDPAddr{Port: udpPort, IP: net.ParseIP("0.0.0.0")}
		conn, err := net.ListenUDP("udp", &addr)
		if err != nil {
			log.Fatal("UDP Error:", err)
		}
		defer conn.Close()

		buf := make([]byte, 2048)
		for {
			n, remoteAddr, err := conn.ReadFromUDP(buf)
			if err != nil {
				continue
			}

			var info NodeInfo
			if err := json.Unmarshal(buf[:n], &info); err == nil {
				// 1.1 Validate Agent Secret
				if agentSecret != "" && info.Secret != agentSecret {
					log.Printf("DEBUG: Discarded unauthorized heartbeat from %s (invalid secret)", remoteAddr.IP.String())
					continue
				}

				if debug {
					log.Printf("DEBUG: Heartbeat received from %s (%s)", info.Hostname, remoteAddr.IP.String())
				}

				// 1.2 Update Internal State
				info.IP = remoteAddr.IP.String()
				info.LastSeen = time.Now().UTC().Truncate(time.Second)
				info.Secret = "" // Don't forward secret to worker
				
				nodesMu.Lock()
				nodes[info.Hostname] = info
				nodesMu.Unlock()
			}
		}
	}()

	// 2. WebSocket Handler
	mux := http.NewServeMux()
	
	// Root handler for health check
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			log.Printf("404: %s %s from %s", r.Method, r.URL.Path, r.RemoteAddr)
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/plain")
		fmt.Fprintf(w, "Meta Hub Active\nNodes: %d\nTime: %s", len(nodes), time.Now().Format(time.RFC3339))
	})

	mux.HandleFunc("/nodes", func(w http.ResponseWriter, r *http.Request) {
		token := r.Header.Get("X-Hub-Secret")
		if token == "" {
			token = r.URL.Query().Get("secret")
		}

		if hubSecret != "" && token != hubSecret {
			log.Printf("Unauthorized connection attempt from %s", r.RemoteAddr)
			http.Error(w, "Unauthorized", 401)
			return
		}

		nodesMu.Lock()
		data, err := json.Marshal(nodes)
		nodesMu.Unlock()

		if err != nil {
			http.Error(w, "Internal Server Error", 500)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.Write(data)
	})

	// Logging Middleware
	logger := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s %s", r.RemoteAddr, r.Method, r.URL.Path)
		mux.ServeHTTP(w, r)
	})

	// 3. Periodic Cleanup
	go func() {
		ticker := time.NewTicker(time.Duration(interval) * time.Second)
		for range ticker.C {
			nodesMu.Lock()
			now := time.Now()
			changed := false
			for h, info := range nodes {
				if now.Sub(info.LastSeen) > 5*time.Minute {
					if debug {
						log.Printf("DEBUG: Node %s timed out, removing...", h)
					}
					delete(nodes, h)
					changed = true
				}
			}
			nodesMu.Unlock()
			
			if changed {
				// Optional: broadcast empty update to signal list change
			}
		}
	}()

	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%d", httpPort), logger))
}


func maskSecret(s string) string {
	if len(s) <= 2 { return "***" }
	return s[:2] + "..."
}

// --- Agent Implementation ---

func runAgent(hubAddr string, interval int, secret string, debug bool) {
	hostname := os.Getenv("WORKSPACE_SLUG")
	if hostname == "" {
		hostname = "unknown-host"
	}
	log.Printf("MODE: AGENT STARTING...")
	log.Printf("Hub Address: %s", hubAddr)
	log.Printf("Interval:    %ds", interval)
	log.Printf("Hostname:    %v, Debug=%v", hostname, debug)

	udpAddr, err := net.ResolveUDPAddr("udp", hubAddr)
	if err != nil {
		log.Fatal("Invalid Hub address:", err)
	}

	conn, err := net.DialUDP("udp", nil, udpAddr)
	if err != nil {
		log.Fatal("UDP connection error:", err)
	}
	defer conn.Close()

	prevIdle, prevTotal := getCPUTimes()
	for {
		currIdle, currTotal := getCPUTimes()
		idleDelta := currIdle - prevIdle
		totalDelta := currTotal - prevTotal
		
		cpu := 0.0
		if totalDelta > 0 {
			cpu = (1.0 - float64(idleDelta)/float64(totalDelta)) * 100.0
		}
		prevIdle, prevTotal = currIdle, currTotal

		info := NodeInfo{
			Hostname: hostname,
			CPU:      mathRound(cpu, 2),
			RAM:      getRAMUsage(),
			Disk:     getDiskUsage(),
			Uptime:   getUptime(),
			Secret:   secret, // Include secret in heartbeat
		}

		data, _ := json.Marshal(info)
		_, err := conn.Write(data)
		if err != nil {
			log.Printf("Heartbeat send failed: %v", err)
		} else if debug {
			log.Printf("DEBUG: Heartbeat sent to %s", hubAddr)
		}

		time.Sleep(time.Duration(interval) * time.Second)
	}
}

// --- Helper Functions ---

func getCPUTimes() (idle, total uint64) {
	data, err := ioutil.ReadFile("/proc/stat")
	if err != nil {
		return 0, 0
	}
	lines := strings.Split(string(data), "\n")
	if len(lines) == 0 { return 0, 0 }
	fields := strings.Fields(lines[0])
	for i := 1; i < len(fields); i++ {
		val, _ := strconv.ParseUint(fields[i], 10, 64)
		total += val
		if i == 4 { idle = val }
	}
	return
}

func getRAMUsage() float64 {
	data, err := ioutil.ReadFile("/proc/meminfo")
	if err != nil {
		return 0
	}
	var total, available uint64
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 2 { continue }
		val, _ := strconv.ParseUint(fields[1], 10, 64)
		switch fields[0] {
		case "MemTotal:": total = val
		case "MemAvailable:": available = val
		}
	}
	if total == 0 { return 0 }
	
	// If MemAvailable is present (modern kernels), use it for better accuracy
	if available > 0 {
		used := total - available
		return mathRound(float64(used)/float64(total)*100.0, 2)
	}
	return 0
}

func getDiskUsage() float64 {
	return getDiskUsageOS()
}

func mathRound(val float64, precision int) float64 {
	p := 1.0
	for i := 0; i < precision; i++ { p *= 10 }
	return float64(int(val*p+0.5)) / p
}

func getUptime() string {
	data, err := ioutil.ReadFile("/proc/uptime")
	if err != nil {
		return "0s"
	}
	seconds, _ := strconv.ParseFloat(strings.Fields(string(data))[0], 64)
	d := int(seconds) / (24 * 3600)
	h := (int(seconds) % (24 * 3600)) / 3600
	m := (int(seconds) % 3600) / 60
	s := int(seconds) % 60
	if d > 0 { return fmt.Sprintf("%dd %dh %dm", d, h, m) }
	if h > 0 { return fmt.Sprintf("%dh %dm", h, m) }
	if m > 0 { return fmt.Sprintf("%dm %ds", m, s) }
	return fmt.Sprintf("%ds", s)
}

// --- Main Entry ---

func main() {
	// Root flags
	mode := flag.String("mode", "agent", "Mode to run: 'hub' or 'agent'")
	debug := flag.Bool("debug", false, "Enable verbose logging")
	
	// Common flags
	interval := flag.Int("interval", 5, "Interval in seconds")
	
	// Hub flags
	udpPort := flag.Int("udp", 9999, "HUB: UDP port for heartbeats")
	httpPort := flag.Int("http", 8080, "HUB: HTTP port for Telemetry")
	hubSecret := flag.String("secret", "diamon", "HUB: Secret for Worker connection")
	agentSecret := flag.String("agent-secret", "diamon", "HUB: Expected secret from Agents")
	
	// Agent flags
	hubAddr := flag.String("hub", "127.0.0.1:9999", "AGENT: Hub UDP address (IP:PORT)")
	agentKey := flag.String("key", "diamon", "AGENT: Secret key to send to Hub")

	flag.Parse()

	switch *mode {
	case "hub":
		runHub(*udpPort, *httpPort, *interval, *hubSecret, *agentSecret, *debug)
	case "agent":
		runAgent(*hubAddr, *interval, *agentKey, *debug)
	default:
		fmt.Printf("Invalid mode: %s. Use 'hub' or 'agent'.\n", *mode)
		os.Exit(1)
	}
}
