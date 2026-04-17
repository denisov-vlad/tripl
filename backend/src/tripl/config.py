from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://tripl:tripl@localhost:5432/tripl"
    sync_database_url: str = "postgresql+psycopg://tripl:tripl@localhost:5432/tripl"
    rabbitmq_url: str = "amqp://guest:guest@localhost:5672//"
    encryption_key: str = ""  # Fernet key for encrypting data source passwords
    app_base_url: str = ""
    debug: bool = False

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
