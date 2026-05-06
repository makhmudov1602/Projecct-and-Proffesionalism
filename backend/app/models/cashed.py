from sqlalchemy import Column, Integer, Text, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship

from app.database import Base


class Cached(Base):
    __tablename__ = "cached"

    Id = Column(Integer, primary_key=True)
    CameraId = Column(Integer, ForeignKey("cameras.Id", ondelete="CASCADE"), nullable=False)
    ImageUrl = Column(Text, nullable=True)
    ImageBase64 = Column(Text, nullable=True)
    IsTaskDone = Column(Boolean, default=False)
    CreatedAt = Column(DateTime(timezone=True), server_default=func.now())
    UpdatedAt = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    # relationships
    camera = relationship("Camera", back_populates="cached_images")
