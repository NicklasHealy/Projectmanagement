#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sqlite3, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

if len(sys.argv) != 2:
    print("Usage: python checkin.py <db_path>")
    sys.exit(1)

DB_PATH = sys.argv[1]
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

# Find active session
c.execute("SELECT id, user_name FROM sessions WHERE checked_in_at IS NULL ORDER BY checked_out_at DESC LIMIT 1")
active_session = c.fetchone()

if active_session:
    session_id, user_name = active_session
    # Check in the session
    c.execute("UPDATE sessions SET checked_in_at = datetime('now') WHERE id = ?", (session_id,))
    conn.commit()
    print(f"Checked in session for user '{user_name}' (ID: {session_id})")
else:
    print("No active session found to check in")

conn.close()