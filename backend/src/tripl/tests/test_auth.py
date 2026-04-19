import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_creates_user_and_session_cookie(anon_client: AsyncClient):
    response = await anon_client.post(
        "/api/v1/auth/register",
        json={
            "email": "owner@example.com",
            "password": "Password123!",
            "name": "Owner",
        },
    )

    assert response.status_code == 201
    assert response.json()["email"] == "owner@example.com"
    assert "tripl_session=" in response.headers["set-cookie"]


@pytest.mark.asyncio
async def test_login_returns_cookie_and_me(anon_client: AsyncClient):
    await anon_client.post(
        "/api/v1/auth/register",
        json={
            "email": "owner@example.com",
            "password": "Password123!",
        },
    )

    login_response = await anon_client.post(
        "/api/v1/auth/login",
        json={
            "email": "OWNER@example.com",
            "password": "Password123!",
        },
    )

    assert login_response.status_code == 200

    me_response = await anon_client.get("/api/v1/auth/me")
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "owner@example.com"


@pytest.mark.asyncio
async def test_protected_route_requires_auth(anon_client: AsyncClient):
    response = await anon_client.get("/api/v1/projects")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_logout_clears_cookie_and_blocks_follow_up_request(client: AsyncClient):
    logout_response = await client.post("/api/v1/auth/logout")
    assert logout_response.status_code == 204

    me_response = await client.get("/api/v1/auth/me")
    assert me_response.status_code == 401
