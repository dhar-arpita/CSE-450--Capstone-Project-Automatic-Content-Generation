import asyncio
from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

# ---- Tool ----
def get_weather(city: str) -> dict:
    """Retrieves the current weather report for a specified city.

    Args:
        city (str): The name of the city.

    Returns:
        dict: status and report or error message.
    """
    print(f"--- Tool: get_weather called for city: {city} ---")
    city_normalized = city.lower().replace(" ", "")

    mock_weather_db = {
        "newyork": {"status": "success", "report": "New York: sunny, 25°C."},
        "london": {"status": "success", "report": "London: cloudy, 15°C."},
        "tokyo": {"status": "success", "report": "Tokyo: light rain, 18°C."},
        "dhaka": {"status": "success", "report": "Dhaka: hot and humid, 32°C."},
        "chittagong": {"status": "success", "report": "Chittagong: partly cloudy, 30°C."},
    }

    if city_normalized in mock_weather_db:
        return mock_weather_db[city_normalized]
    else:
        return {"status": "error", "error_message": f"Sorry, no weather data for '{city}'."}


# ---- Agent ----
root_agent = Agent(
    name="weather_agent_v1",
    model="gemini-2.5-flash",
    description="Provides weather information for specific cities.",
    instruction="You are a helpful weather assistant. "
                "Use the 'get_weather' tool when user asks about weather. "
                "If error, inform politely. If success, present clearly.",
    tools=[get_weather],
)


# ---- Interaction Function ----
async def call_agent(query: str, runner, user_id, session_id):
    print(f"\n>>> User: {query}")

    content = types.Content(role='user', parts=[types.Part(text=query)])

    final_response = "No response."

    async for event in runner.run_async(
        user_id=user_id, session_id=session_id, new_message=content
    ):
        if event.is_final_response():
            if event.content and event.content.parts:
                final_response = event.content.parts[0].text
            break

    print(f"<<< Agent: {final_response}")


# ---- Main ----
async def main():
    session_service = InMemorySessionService()

    APP_NAME = "weather_app"
    USER_ID = "user_1"
    SESSION_ID = "session_001"

    # Create session
    await session_service.create_session(
        app_name=APP_NAME,
        user_id=USER_ID,
        session_id=SESSION_ID
    )

    # Create runner
    runner = Runner(
        agent=root_agent,
        app_name=APP_NAME,
        session_service=session_service
    )

    # Test queries
    await call_agent("What is the weather in London?", runner, USER_ID, SESSION_ID)
    await call_agent("How about Paris?", runner, USER_ID, SESSION_ID)
    await call_agent("Tell me weather in Chittagong", runner, USER_ID, SESSION_ID)


# ---- Run ----
if __name__ == "__main__":
    asyncio.run(main())