from sqlalchemy import Column, Integer, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship

from app.database import Base


class Result(Base):
    __tablename__ = "result"

    Id = Column(Integer, primary_key=True)
    UserId = Column(Integer, ForeignKey("users.Id", ondelete="RESTRICT"), nullable=False)
    CreatedAt = Column(DateTime(timezone=True), server_default=func.now())
    UpdatedAt = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
    PublishedAt = Column(DateTime(timezone=True), nullable=True)

    # relationships
    user = relationship("User", back_populates="results")
    points = relationship("Point", back_populates="result", cascade="all, delete")
