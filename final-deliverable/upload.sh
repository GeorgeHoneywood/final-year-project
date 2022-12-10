#!/bin/bash

rsync -zavh --relative "index.html" "dist/" "sw.js" "data/england.map" "git.honeyfox.uk:/var/www/html/files.george.honeywood.org.uk/final-deliverable/"
