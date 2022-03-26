#!/bin/bash

shopt -s globstar

CURRENT_DIR="${BASH_SOURCE%/*}"
PARENT_DIR="$CURRENT_DIR/.."
FILES_MATCHER="$PARENT_DIR/**/*.*"

for file in $FILES_MATCHER
do
	$CURRENT_DIR/enhanced-prettier.js "$file" &
done

wait
