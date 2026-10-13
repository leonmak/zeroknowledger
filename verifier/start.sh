#!/bin/bash
# Runs the TLSNotary verifier; if it exits, the container exits so it gets restarted.
exec /app/tlsn-verifier-server
