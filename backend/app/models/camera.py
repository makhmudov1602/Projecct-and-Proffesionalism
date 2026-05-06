from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship

from app.database import Base


class Camera(Base):
    __tablename__ = "cameras"

    Id = Column(Integer, primary_key=True)
    BranchId = Column(Integer, ForeignKey("branch.Id", ondelete="CASCADE"), nullable=False)
    Username = Column(String(150), nullable=False)
    PasswordHash = Column(String(255), nullable=False)
    IpAddress = Column(String(45), nullable=False)
    Description = Column(Text, nullable=True)
    CreatedAt = Column(DateTime(timezone=True), server_default=func.now())
    UpdatedAt = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    # relationships
    branch = relationship("Branch", back_populates="cameras")
    cached_images = relationship("Cached", back_populates="camera", cascade="all, delete")
