#!/bin/bash

cd dist || exit

# /data folder contains large map files we don't want to upload
rsync -zavh --relative "index.html" "assets/" "icons/" "sw.js" "git.honeyfox.uk:/var/www/html/files.george.honeywood.org.uk/final-deliverable/"
