#!/bin/bash

rsync -zavh --relative "index.html" "dist/" "assets/" "sw.js" "git.honeyfox.uk:/var/www/html/files.george.honeywood.org.uk/final-deliverable/"
