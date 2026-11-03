// Package scripts is remarkable/scripts/: the shell scripts a person runs
// from a computer to install the reader (install.sh, INSTALL.md step 4). It
// holds no Go code of its own; its tests drive install.sh with /bin/sh
// against a stand-in site, stand-in ssh and scp, and a fake tablet.
package scripts
