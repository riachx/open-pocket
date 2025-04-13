import os
from dotenv import load_dotenv
import httpx

load_dotenv()

# src/services/candidateFunctions.py
import sqlite3

def getCandidateIdByName(candidate_name):
    """Get a candidate's ID from the database given their name"""
    try:
        conn = sqlite3.connect('politicaldata.db')
        cursor = conn.cursor()
        
        # Try exact match first
        cursor.execute('SELECT CAND_ID FROM candidates WHERE CAND_NAME = ? COLLATE NOCASE', (candidate_name,))
        result = cursor.fetchone()
        
        # If no exact match, try partial match
        if not result:
            cursor.execute('SELECT CAND_ID FROM candidates WHERE CAND_NAME LIKE ? COLLATE NOCASE LIMIT 1', 
                          (f'%{candidate_name}%',))
            result = cursor.fetchone()
            
        conn.close()
        return result[0] if result else None
    except Exception as e:
        print(f"Error finding candidate ID: {e}")
        return None
