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

	"github.com/gorilla/websocket"
)

// --- Shared Types ---

type NodeInfo struct {
	Hostname string    `json:"hostname"`
	CPU      float64   `json:"cpu"`
	RAM      float64   `json:"ram"`
	Uptime   string    `json:"uptime"`
	IP       string    `json:"ip,omitempty"`
	LastSeen time.Time `json:"last_seen"`
}

// --- Hub Implementation ---

var (
	nodes     = make(map[string]NodeInfo)
	nodesMu   sync.Mutex
	upgrader  = websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	clients   = make(map[*websocket.Conn]bool)
	clientsMu sync.Mutex
)

func runHub(udpPort, httpPort, interval int, secret string) {
	log.Printf("MODE: HUB STARTING...")
	log.Printf("UDP Listener: :%d", udpPort)
	log.Printf("HTTP Stream:   :%d/stream", httpPort)
	log.Printf("Settings:      Batch=%ds", interval)

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
				info.IP = remoteAddr.IP.String()
				info.LastSeen = time.Now()
				nodesMu.Lock()
				nodes[info.Hostname] = info
				nodesMu.Unlock()
			}
		}
	}()

	// 2. WebSocket Handler
	http.HandleFunc("/stream", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Hub-Secret") != secret {
			log.Printf("Unauthorized connection attempt from %s", r.RemoteAddr)
			http.Error(w, "Unauthorized", 401)
			return
		}
		ws, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("Upgrade Error: %v", err)
			return
		}
		defer ws.Close()

		clientsMu.Lock()
		clients[ws] = true
		clientsMu.Unlock()

		log.Printf("Worker connected: %s", r.RemoteAddr)

		for {
			if _, _, err := ws.ReadMessage(); err != nil {
				clientsMu.Lock()
				delete(clients, ws)
				clientsMu.Unlock()
				log.Printf("Worker disconnected: %s", r.RemoteAddr)
				break
			}
		}
	})

	// 3. Broadcaster
	go func() {
		ticker := time.NewTicker(time.Duration(interval) * time.Second)
		for range ticker.C {
			nodesMu.Lock()
			now := time.Now()
			for h, info := range nodes {
				if now.Sub(info.LastSeen) > 5*time.Minute {
					delete(nodes, h)
				}
			}
			data, _ := json.Marshal(nodes)
			nodesMu.Unlock()

			clientsMu.Lock()
			for client := range clients {
				if err := client.WriteMessage(websocket.TextMessage, data); err != nil {
					client.Close()
					delete(clients, client)
				}
			}
			clientsMu.Unlock()
		}
	}()

	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%d", httpPort), nil))
}

// --- Agent Implementation ---

func runAgent(hubAddr string, interval int) {
	hostname := os.Getenv("WORKSPACE_SLUG")
	if hostname == "" {
		hostname = "unknown-host"
	}
	log.Printf("MODE: AGENT STARTING...")
	log.Printf("Hub Address: %s", hubAddr)
	log.Printf("Interval:    %ds", interval)
	log.Printf("Hostname:    %s", hostname)

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
		time.Sleep(time.Duration(interval) * time.Second)
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
			Uptime:   getUptime(),
		}

		data, _ := json.Marshal(info)
		conn.Write(data)
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
	var total, free, buffers, cached uint64
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 2 { continue }
		val, _ := strconv.ParseUint(fields[1], 10, 64)
		switch fields[0] {
		case "MemTotal:": total = val
		case "MemFree:":  free = val
		case "Buffers:":  buffers = val
		case "Cached:":   cached = val
		}
	}
	if total == 0 { return 0 }
	used := total - (free + buffers + cached)
	return mathRound(float64(used)/float64(total)*100.0, 2)
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

func mathRound(val float64, precision int) float64 {
	p := 1.0
	for i := 0; i < precision; i++ { p *= 10 }
	return float64(int(val*p+0.5)) / p
}

// --- Main Entry ---

func main() {
	// Root flags
	mode := flag.String("mode", "agent", "Mode to run: 'hub' or 'agent'")
	
	// Hub flags
	udpPort := flag.Int("udp", 9999, "HUB: UDP port for heartbeats")
	httpPort := flag.Int("http", 8080, "HUB: HTTP port for WebSockets")
	secret := flag.String("secret", "diamon", "HUB: Secret for Worker connection")
	
	// Agent flags
	hubAddr := flag.String("hub", "127.0.0.1:9999", "AGENT: Hub UDP address (IP:PORT)")
	
	// Common flags
	interval := flag.Int("interval", 5, "Interval (Hub batching or Agent heartbeat) in seconds")

	flag.Parse()

	switch *mode {
	case "hub":
		runHub(*udpPort, *httpPort, *interval, *secret)
	case "agent":
		runAgent(*hubAddr, *interval)
	default:
		fmt.Printf("Invalid mode: %s. Use 'hub' or 'agent'.\n", *mode)
		os.Exit(1)
	}
}
