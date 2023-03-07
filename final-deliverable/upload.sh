#!/bin/bash

cd dist || exit

# /data folder contains large map files we don't want to upload
# --delete is okay because it doesn't touch the excludes folder
# put --include="data/<name>.map" first to upload new map file
rsync -zavh --relative --delete --exclude "data/" "." "git.honeyfox.uk:/var/www/html/files.george.honeywood.org.uk/final-deliverable/"
