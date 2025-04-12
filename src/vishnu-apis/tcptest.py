import littlesis
from littlesis import littlesis as ls
from typing import List, Dict, Any
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class ContextRequest(BaseModel):
    text: str
    num_results: int = 5

class ContextResponse(BaseModel):
    results: List[Dict[str, Any]]

@app.post("/context")
async def get_context(request: ContextRequest) -> ContextResponse:
    try:
        # Query LittleSis for the entity
        entity_data = ls.entity(request.text)
        
        # Extract relevant information from the response
        if 'data' in entity_data:
            entity = entity_data['data']
            result = {
                "entity_name": entity['attributes']['name'],
                "entity_type": entity['attributes']['primary_ext'],
                "description": entity['attributes']['blurb'],
                "summary": entity['attributes']['summary'],
                "source": "LittleSis Database",
                "relevance_score": 1.0,
                "id": entity['id']
            }
            return ContextResponse(results=[result])
        else:
            return ContextResponse(results=[{
                "error": "No entity found",
                "source": "LittleSis Database"
            }])
            
    except Exception as e:
        return ContextResponse(results=[{
            "error": str(e),
            "source": "LittleSis Database"
        }])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)