from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship

from app.database import Base


class Branch(Base):
    __tablename__ = "branch"

    Id = Column(Integer, primary_key=True)
    Name = Column(String(200), nullable=False)
    RegionId = Column(Integer, ForeignKey("region.Id", ondelete="RESTRICT"), nullable=False)
    Description = Column(Text, nullable=True)
    CreatedAt = Column(DateTime(timezone=True), server_default=func.now())
    UpdatedAt = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    # relationships
    region = relationship("Region", back_populates="branches")
    cameras = relationship("Camera", back_populates="branch", cascade="all, delete")
    users = relationship("User", back_populates="branch")
