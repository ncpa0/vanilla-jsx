#!/usr/bin/env bash

set -o xtrace
set -o errexit

git config user.name github-actions
git config user.email github-actions@github.com

echo "Publishing to npm"
npm publish --access public
