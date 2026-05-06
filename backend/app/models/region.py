from sqlalchemy import Column, Integer, String, Text, DateTime, func
from sqlalchemy.orm import relationship

from app.database import Base


class Region(Base):
    __tablename__ = "region"

    Id = Column(Integer, primary_key=True)
    Name = Column(String(200), unique=True, nullable=False)
    Description = Column(Text, nullable=True)
    CreatedAt = Column(DateTime(timezone=True), server_default=func.now())
    UpdatedAt = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    # relationships
    branches = relationship("Branch", back_populates="region")
