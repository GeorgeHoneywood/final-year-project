#!/bin/bash

rsync -zavh "$1" "git.honeyfox.uk:/var/www/html/files.george.honeywood.org.uk/$1"
