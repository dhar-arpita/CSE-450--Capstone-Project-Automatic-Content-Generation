# seed_test_student.py
# Ekbar chalale ekta test user + student toiri hoye jabe, chatbot testing er jonno.
# Chalanor niyom (backend folder theke, venv active thakle):
#     python seed_test_student.py
# Ba Docker container er bhitor theke:
#     docker compose exec capstone_backend python seed_test_student.py

from datetime import date
from core.config import SessionLocal
from models.db_models import User, Student, Class

db = SessionLocal()

try:
    # --- prothome ekta Class na thakle banao (Student.class_name FK Class ke point kore) ---
    existing_class = db.query(Class).filter(Class.class_name == "Class 9").first()
    if not existing_class:
        new_class = Class(class_name="Class 9", educational_level="Secondary")
        db.add(new_class)
        db.commit()
        print("Created Class: 'Class 9'")
    else:
        print("Class 'Class 9' already exists, skipping.")

    # --- Test user check kori (email diye), na thakle banai ---
    existing_user = db.query(User).filter(User.email == "test@student.com").first()
    if existing_user:
        print(f"User already exists: user_id={existing_user.user_id}")
        user_id = existing_user.user_id
    else:
        new_user = User(
            name="Test Student",
            email="test@student.com",
            password="dummy_password",   # eta shudhu testing er jonno, real hashing na
            role="student",
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        user_id = new_user.user_id
        print(f"Created User: user_id={user_id}")

    # --- Student row check kori, na thakle banai ---
    existing_student = db.query(Student).filter(Student.student_id == user_id).first()
    if existing_student:
        print(f"Student already exists: student_id={existing_student.student_id}")
    else:
        new_student = Student(
            student_id=user_id,
            class_name="Class 9",
            last_active_date=None,
        )
        db.add(new_student)
        db.commit()
        print(f"Created Student: student_id={user_id}")

    print(f"\n✅ Use this in your API requests: \"student_id\": {user_id}")

except Exception as e:
    db.rollback()
    print(f"Error: {e}")
finally:
    db.close()