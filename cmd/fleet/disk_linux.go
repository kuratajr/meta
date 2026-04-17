// +build linux

package main

import "syscall"

func getDiskUsageOS() float64 {
	var stat syscall.Statfs_t
	// Check root partition by default
	err := syscall.Statfs("/", &stat)
	if err != nil {
		log.Printf("DEBUG: Disk Usage Error: %v", err)
		return 0
	}
	// Blocks * size = total bytes
	all := float64(stat.Blocks) * float64(stat.Bsize)
	free := float64(stat.Bfree) * float64(stat.Bsize)
	used := all - free
	if all == 0 { return 0 }
	return mathRound(used / all * 100.0, 2)
}
