from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "CaseFlow"

    postgres_url: str = "postgresql://caseflow:caseflow@localhost:5432/caseflow"

    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "caseflow_password"

    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 8

    class Config:
        env_file = ".env"


settings = Settings()
