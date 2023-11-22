import os
import psycopg2
from dotenv import load_dotenv
from flask import Flask, request

INSERT_REQUEST = "INSERT INTO public.request (id, date, requestor, project_id, status, db_id, org_admin_id, data_collection_start_date, data_collection_end_date, data_participants_num, data_description, data_keywords, additional_info) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);"
INSERT_ORG_ADMIN = "INSERT INTO public.org_admin (id, email) VALUES (%s, %s);"
INSERT_DB = "INSERT INTO public.researcher_db (id, db_name, db_type) VALUES (%s, %s, %s);"
INSERT_PROJECT = "INSERT INTO public.project (id, name, start_date, end_date, lead, members, university, faculty, ethics_id, description) VALUES "

SELECT_REQUEST = "SELECT (id, date, project_id, project) FROM public.request;"
load_dotenv()

app = Flask(__name__)
url = os.getenv("DATABASE_URL")
connection = psycopg2.connect(url)

@app.post("/api/request")
def create_request():
    data = request.get_json()
    id  = data["id"]
    date = data["date"]
    requestor = data["requestor"]
    project_id = data["project_id"]
    status = data["status"]
    
    with connection:
        with connection.cursor() as cursor:
            cursor.execute(INSERT_REQUEST, (id, date, requestor, project_id, status))
    
    return {"message": f"Request {id} created successfully"}, 201

@app.get("/api/request")
def get_request():
    with connection:
        with connection.cursor() as cursor:
            cursor.execute(SELECT_REQUEST)
            return cursor.fetchall()