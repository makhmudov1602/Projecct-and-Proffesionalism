from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, func
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class Role(enum.Enum):
    Admin = "Admin"
    SuperAdmin = "SuperAdmin"
    User = "User"

class User(Base):
    __tablename__ = "users"

    Id = Column(Integer, primary_key=True)
    Username = Column(String(150), unique=True, nullable=False)
    PasswordHash = Column(String(255), nullable=False)
    Role = Column(Enum(Role), default=Role.User, nullable=False)
    EmployeeId = Column(Integer, ForeignKey("employees.Id", ondelete="RESTRICT"), nullable=False)
    BarnchId = Column(Integer, ForeignKey("branch.Id", ondelete="RESTRICT"), nullable=False)
    CreatedAt = Column(DateTime(timezone=True), server_default=func.now())
    UpdatedAt = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    # relationships
    employee = relationship("Employee")
    branch = relationship("Branch", back_populates="users")
    results = relationship("Result", back_populates="user")
