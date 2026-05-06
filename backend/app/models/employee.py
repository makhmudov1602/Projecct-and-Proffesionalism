from sqlalchemy import Column, Integer, String, DateTime, Text, func
from app.database import Base


class Employee(Base):
    __tablename__ = "employees"

    Id = Column(Integer, primary_key=True, index=True)
    FirstName = Column(String(150), nullable=False)
    LastName = Column(String(150), nullable=False)
    Patronymic = Column(String(150), nullable=True)
    Pnfl = Column(String(20), unique=True, nullable=True)
    PhotoBase64 = Column(Text, nullable=True)
    PhotoMime = Column(String(50), default="image/jpeg")

    CreatedAt = Column(DateTime(timezone=True), server_default=func.now())
    UpdatedAt = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
