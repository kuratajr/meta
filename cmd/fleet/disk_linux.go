// +build linux

package main

import "syscall"

func getDiskUsageOS() float64 {
	// Prioritize /home as requested, but fall back to / for standard systems
	mounts := []string{"/home", "/", "/mnt/stateful_partition"}
	
	for _, m := range mounts {
		var stat syscall.Statfs_t
		err := syscall.Statfs(m, &stat)
		if err != nil {
			continue
		}

		// If we found a partition with actual capacity, use it
		if stat.Blocks > 0 {
			all := float64(stat.Blocks) * float64(stat.Bsize)
			free := float64(stat.Bfree) * float64(stat.Bsize)
			used := all - free
			return mathRound(used / all * 100.0, 2)
		}
	}

	return 0
}
