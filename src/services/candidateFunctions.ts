// TypeScript wrapper for Python candidate functions
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

// reduce api calls pls
const nameCache: Record<string, string> = {};

export async function getCandidateNameFromDb(candidateId: string): Promise<string | null> {
  try {
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const dbPath = path.resolve(__dirname, 'politicaldata.db');
    
    // is this efficient 
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    
    
    const candidate = await db.get(
      'SELECT CAND_NAME FROM candidates_master WHERE CAND_ID = ?',
      candidateId
    );
    
    if (candidate && candidate.CAND_NAME) {
      await db.close();
      return candidate.CAND_NAME;
    }
    
    // Then try senate table
    const senator = await db.get(
      'SELECT name FROM senate WHERE id = ?',
      candidateId
    );
    
    await db.close();
    
    if (senator && senator.name) {
      return senator.name;
    }
    
    return null;
  } catch (error) {
    console.error(`Error accessing database for candidate ${candidateId}:`, error);
    return null;
  }
}

/**
 * Get a candidate's name from the API given their ID
 */
export const getCandidateName = async (nameOrId: string): Promise<string> => {
  // If it's already a name (not an ID format), return it
  if (!nameOrId.match(/^[A-Z][0-9][A-Z]{2}[0-9]{5}$/) && 
      !nameOrId.match(/Senator \(ID: ([A-Z0-9]+)\)/)) {
    return nameOrId;
  }
  
  // Extract ID if in the format "Senator (ID: XXX)"
  let candidateId = nameOrId;
  const idMatch = nameOrId.match(/Senator \(ID: ([A-Z0-9]+)\)/);
  if (idMatch && idMatch[1]) {
    candidateId = idMatch[1];
  }
  
  // Check cache first
  if (nameCache[candidateId]) {
    return nameCache[candidateId];
  }
  
  // First check local database
  try {
    const nameFromDb = await getCandidateNameFromDb(candidateId);
    if (nameFromDb) {
      // Cache the result
      nameCache[candidateId] = nameFromDb;
      return nameFromDb;
    }
  } catch (dbError) {
    console.error(`Database error for ${candidateId}:`, dbError);
    // Continue to API if database fails
  }
  
  // Then try API if not found in database
  try {
    // Call our API endpoint that uses the Python function
    const response = await fetch(`http://localhost:3001/api/candidate-info/${candidateId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data && data.name) {
      // Cache the result
      nameCache[candidateId] = data.name;
      return data.name;
    }
  } catch (error) {
    console.error(`Error fetching name for ${candidateId}:`, error);
  }
  
  // Fallback to original string if all methods fail
  return nameOrId;
} 

/**
 * Get a candidate's ID from the database given their name
 * @param candidateName The full name of the candidate to search for
 * @returns The candidate ID if found, null otherwise
 */
export async function getCandidateIdByName(candidateName: string): Promise<string | null> {
    const sqlite3 = require('sqlite3');
    const { open } = require('sqlite');
    const path = require('path');
    
    // Open database connection
    const db = await open({
      filename: path.resolve(__dirname, 'politicaldata.db'),
      driver: sqlite3.Database
    });
    
    try {
      // query for candidate with exact name match
      const candidate = await db.get(
        'SELECT CAND_ID FROM candidates_master WHERE CAND_NAME = ? COLLATE NOCASE',
        [candidateName]
      );
      
      // if no exact match, try partial match
      if (!candidate) {
        const fuzzyMatch = await db.get(
          'SELECT CAND_ID FROM candidates_master WHERE CAND_NAME LIKE ? COLLATE NOCASE LIMIT 1',
          [`%${candidateName}%`]
        );
        return fuzzyMatch ? fuzzyMatch.CAND_ID : null;
      }
      
      return candidate.CAND_ID;
    } catch (error) {
      console.error(`Error finding candidate ID for "${candidateName}":`, error);
      return null;
    } finally {
      await db.close();
    }
  }