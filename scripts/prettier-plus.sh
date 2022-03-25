#!/bin/bash

shopt -s globstar

PARENT_DIR="${BASH_SOURCE%/*}/.."

prettier -w $PARENT_DIR

PHP_FILES_MATCHER="$PARENT_DIR/**/*.php"

for file in $PHP_FILES_MATCHER
do
	node scripts/post-prettier.js "$file"
done
