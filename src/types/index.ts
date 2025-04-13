export interface Politician {
    id: string;
    name: string;
    party: string;
    
  }
  
  export interface User {
    id: string;
    username: string;
    email: string;
    
  }

  export interface Senator {
    id: number;
    name: string;
    party: string;
    state: string;
    photoUrl?: string;
    phones?: string[];
  }