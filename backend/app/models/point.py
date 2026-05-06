from sqlalchemy import Column, Integer, SmallInteger, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


class Point(Base):
    __tablename__ = "point"

    Id = Column(Integer, primary_key=True)
    ResultId = Column(Integer, ForeignKey("result.Id", ondelete="CASCADE"), nullable=False)
    X_250 = Column(SmallInteger, nullable=False)
    Y_250 = Column(SmallInteger, nullable=False)
    Score = Column(Integer, nullable=False)

    # relationships
    result = relationship("Result", back_populates="points")
