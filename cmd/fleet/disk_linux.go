// +build linux

package main

import "syscall"

func getDiskUsageOS() float64 {
	var stat syscall.Statfs_t
	// Check root partition by default
	err := syscall.Statfs("/", &stat)
	if err != nil {
		return 0
	}
	// Blocks * size = total bytes
	all := stat.Blocks * uint64(stat.Bsize)
	free := stat.Bfree * uint64(stat.Bsize)
	used := all - free
	if all == 0 { return 0 }
	return mathRound(float64(used)/float64(all)*100.0, 2)
}
