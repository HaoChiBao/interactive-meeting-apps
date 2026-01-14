QUESTIONS = [
    # --- LeetCode Style Questions ---
    {
        "id": "lc_two_sum",
        "type": "technical",
        "prompt": "Two Sum: Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. Assume exactly one solution exists.",
        "difficulty": "easy",
        "starter_code": "def two_sum(nums: list[int], target: int) -> list[int]:\n    # Your code here\n    pass"
    },
    {
        "id": "lc_valid_paren",
        "type": "technical",
        "prompt": "Valid Parentheses: Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.",
        "difficulty": "easy",
        "starter_code": "def isValid(s: str) -> bool:\n    # Your code here\n    pass"
    },
    {
        "id": "lc_best_time_stock",
        "type": "technical",
        "prompt": "Best Time to Buy and Sell Stock: You want to maximize your profit by choosing a single day to buy one stock and choosing a different day in the future to sell that stock. Return the maximum profit you can achieve.",
        "difficulty": "easy",
        "starter_code": "def maxProfit(prices: list[int]) -> int:\n    # Your code here\n    pass"
    },
    {
        "id": "lc_climbing_stairs",
        "type": "technical",
        "prompt": "Climbing Stairs: You are climbing a staircase. It takes n steps to reach the top. Each time you can either climb 1 or 2 steps. In how many distinct ways can you climb to the top?",
        "difficulty": "easy",
        "starter_code": "def climbStairs(n: int) -> int:\n    # Your code here\n    pass"
    },
    {
        "id": "lc_fizz_buzz",
        "type": "technical",
        "prompt": "Fizz Buzz: Given an integer n, return a string array where answer[i] == 'FizzBuzz' if i is divisible by 3 and 5, 'Fizz' if by 3, 'Buzz' if by 5, or i as a string.",
        "difficulty": "easy",
        "starter_code": "def fizzBuzz(n: int) -> list[str]:\n    # Your code here\n    pass"
    },

    # --- Behavioral Questions ---
    {
        "id": "b1",
        "type": "behavioral",
        "prompt": "Tell me about a time you had a conflict with a coworker and how you resolved it.",
        "difficulty": "medium"
    },
    {
        "id": "b2",
        "type": "behavioral",
        "prompt": "Describe a project you are most proud of and why.",
        "difficulty": "easy"
    },
    {
        "id": "b3",
        "type": "behavioral",
        "prompt": "Tell me about a time you failed or made a mistake. How did you handle it?",
        "difficulty": "medium"
    },
    {
        "id": "b4",
        "type": "behavioral",
        "prompt": "Describe a situation where you had to meet a tight deadline. How did you prioritize?",
        "difficulty": "medium"
    },
    {
        "id": "b5",
        "type": "behavioral",
        "prompt": "Tell me about a time you disagreed with a manager or lead. What was the outcome?",
        "difficulty": "hard"
    },
    {
        "id": "b6",
        "type": "behavioral",
        "prompt": "Describe a time you had to learn a new technology quickly to complete a task.",
        "difficulty": "medium"
    },
    {
        "id": "b7",
        "type": "behavioral",
        "prompt": "Tell me about a time you received constructive feedback. How did you act on it?",
        "difficulty": "medium"
    },
    {
        "id": "b8",
        "type": "behavioral",
        "prompt": "Describe a time you went above and beyond for a customer or project.",
        "difficulty": "easy"
    },
    {
        "id": "b9",
        "type": "behavioral",
        "prompt": "Tell me about a time you had to explain a complex technical concept to a non-technical stakeholder.",
        "difficulty": "hard"
    },
    {
        "id": "b10",
        "type": "behavioral",
        "prompt": "Describe a significant challenge you faced in a team setting and how you overcame it.",
        "difficulty": "medium"
    }
]

def get_random_question():
    import random
    return random.choice(QUESTIONS)
