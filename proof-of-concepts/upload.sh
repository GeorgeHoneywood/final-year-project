#!/bin/bash

rsync -zavh --exclude "node_modules" "$1" "git.honeyfox.uk:/var/www/html/files.george.honeywood.org.uk/$1"
