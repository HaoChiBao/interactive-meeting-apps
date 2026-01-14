import os
import json
from openai import AsyncOpenAI
import dotenv
import random

dotenv.load_dotenv()

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

async def grade_submission(submission_data, question):
    """
    Grades the submission using OpenAI API.
    Expects submission_data to be a string (code or text).
    Returns a dict with "score" (0-100) and "feedback" (str).
    """
    
    q_type = question.get("type", "behavioral")
    q_prompt = question.get("prompt", "Unknown Question")

    if q_type == "behavioral":
        system_prompt = """
        You are an expert behavioral interviewer using the STAR method (Situation, Task, Action, Result) to grade answers.
        
        Grading Criteria:
        1.  **Structure (40 pts)**: Does the answer strictly follow S-T-A-R?
        2.  **Specificity (30 pts)**:  Are there concrete details, metrics, and "I" statements? Avoiding vague generalizations?
        3.  **Content (30 pts)**: Does the story actually answer the prompt meaningfully?

        Scoring Guide:
        - 0-50: Missing components of STAR, or extremely vague.
        - 51-75: Decent story, but lacks some specificity or a strong Result.
        - 76-90: strong STAR structure, good details.
        - 91-100: Exceptional, quantified result, concise and impactful.
        """
        
        user_prompt = f"""
        Question: {q_prompt}
        
        Candidate Answer:
        {submission_data}
        
        Evaluate this answer based on the STAR method.
        """

    else: # Technical
        system_prompt = """
        You are an expert technical interviewer grading a coding challenge or technical explanation.

        Grading Criteria:
        1.  **Correctness (50 pts)**: Does the code/explanation solve the problem accurately?
        2.  **Efficiency/Depth (30 pts)**: generic O(n^2) when O(n) is possible? Deep understanding vs surface level?
        3.  **Communication/Clarity (20 pts)**: Is the variable naming poor? Is the explanation confusing?

        Scoring Guide:
        - 0-40: Incorrect solution or fundamental misunderstanding.
        - 41-70: Brute force solution, or correct but poorly explained.
        - 71-90: Optimal solution, clean code, good explanation.
        - 91-100: Perfect optimization, handles edge cases, clear clean code.
        """
        
        user_prompt = f"""
        Question: {q_prompt}
        
        Candidate Submission:
        {submission_data}
        
        Evaluate this submission for technical accuracy and efficiency.
        """

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt + "\nProvide output in JSON format: {'score': int, 'feedback': str}"},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"}
        )
        
        content = response.choices[0].message.content
        result = json.loads(content)
        return result

    except Exception as e:
        print(f"Error grading submission: {e}")
        return {
            "score": 0,
            "feedback": "Error during AI grading. Please check server logs."
        }