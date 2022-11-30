#!/bin/bash

rsync -zavh --exclude "node_modules" --exclude "*.map" "$1" "git.honeyfox.uk:/var/www/html/files.george.honeywood.org.uk/$1"
