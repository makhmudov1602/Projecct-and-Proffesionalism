import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SQLITE_DB_NAME = os.getenv("SQLITE_DB_NAME", "university_exam.db")
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{os.path.join(BASE_DIR, DEFAULT_SQLITE_DB_NAME)}"
)
