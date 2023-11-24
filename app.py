import os, psycopg2, json, ast
from dotenv import load_dotenv
from flask import Flask, request
from datetime import datetime
from flask_cors import CORS

INSERT_REQUEST = "INSERT INTO public.request (date, requestor, project_id, status, db_id, org_admin_id, data_collection_start_date, data_collection_end_date, data_participants_num, data_description, data_keywords, additional_info) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id;"
INSERT_ORG_ADMIN = "INSERT INTO public.org_admin (email) VALUES (%s) RETURNING id;"
INSERT_DB = "INSERT INTO public.researcher_db (db_name, db_type) VALUES (%s, %s);"
INSERT_PROJECT = "INSERT INTO public.project (name, start_date, end_date, lead, members, university, faculty, ethics_id, description) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id;"

SELECT_REQUEST_LIST = "SELECT (id, date, requestor, org_admin_id, project_id, status) FROM public.request;"
SELECT_REQUEST_DETAILS = "SELECT (id, date, project_id, db_id, org_admin_id, data_collection_start_date, data_collection_end_date, data_participants_num, data_description, data_keywords, additional_info) FROM public.request WHERE id = %s;"


load_dotenv()

app = Flask(__name__)
CORS(app)
CORS(app, origins=['http://localhost:3000'], methods=['GET', 'POST'], headers=['Content-Type'])
url = os.getenv("DATABASE_URL")
connection = psycopg2.connect(url)


@app.post("/api/request")
def create_request():
    data = request.get_json()
    
    # Request details
    date = data["date"]
    requestor = data["requestor"]
    project_id = 0
    status = 1
    org_admin_id = 0
    db_id = 0
    data_collection_start_date = data["dataInfo"]["collectionDuration"][0]
    data_collection_end_date = data["dataInfo"]["collectionDuration"][1]
    data_participants_num = data["dataInfo"]["participantsNum"]
    data_description = data["dataInfo"]["description"]
    data_keywords = data["dataInfo"]["keywords"]
    additional_info = ""

    # Project details
    project_name = data["projectName"]
    project_start = data["projectDuration"][0]
    project_end = data["projectDuration"][1]
    project_lead = data["projectLead"]
    project_members = data["projectTeamMembers"]
    project_university = data["university"]
    project_faculty = data["faculty"]
    project_ethics_id = data["ethicsApprovalId"]
    project_description = data["projectDescription"]

    with connection:
        with connection.cursor() as cursor:
            cursor.execute(
                INSERT_PROJECT,
                (
                    project_name,
                    project_start,
                    project_end,
                    project_lead,
                    project_members,
                    project_university,
                    project_faculty,
                    project_ethics_id,
                    project_description,
                ),
            )
            project_id = cursor.fetchone()[0]
            if "orgAdminEmail" in data:
                org_admin_email = data["orgAdminEmail"]
                additional_info = data["additionalInfo"]
                cursor.execute(INSERT_ORG_ADMIN, (org_admin_email))
                org_admin_id = cursor.fetchone()[0]
            else:
                db_name = data["databaseInfo"]["name"]
                db_type = data["databaseInfo"]["type"]
                cursor.execute(INSERT_DB, (db_name, db_type))
                db_id = cursor.fetchone()[0]

            cursor.execute(
                INSERT_REQUEST,
                (
                    date,
                    requestor,
                    project_id,
                    status,
                    db_id,
                    org_admin_id,
                    data_collection_start_date,
                    data_collection_end_date,
                    data_participants_num,
                    data_description,
                    data_keywords,
                    additional_info,
                ),
            )
    return {"message": f"Request {id} created successfully"}, 201


@app.get("/api/request-list")
def get_request_list():
    user_id = int(request.args.get("id"))
    user_type = request.args.get("type")
    with connection:
        with connection.cursor() as cursor:
            cursor.execute(SELECT_REQUEST_LIST)
            result = cursor.fetchall()
            requests = []
            for request_data in result:
                data = string_to_tuple(request_data[0])
                request_id, date, requestor, org_admin_id, project_id, status = data
                cursor.execute(
                    f"SELECT name FROM public.project WHERE id = {project_id}"
                )
                project_name = cursor.fetchone()[0]
                if user_type == 'researcher': # and user_id == requestor
                    requests.append(
                        {
                            "id": request_id,
                            "requestDate": date,
                            "projectName": project_name,
                            "requestStatus": status,
                        }
                    )
                elif user_type == 'orgAdmin' and user_id == org_admin_id:
                    print(org_admin_id)
                    requests.append(
                        {
                            "id": request_id,
                            "requestor": requestor,
                            "requestDate": date,
                            "projectName": project_name,
                            "requestStatus": status,
                        }
                    )
                else:
                    continue
            return requests


@app.get("/api/request-details")
def get_request_details():
    request_id = int(request.args.get("id"))
    with connection:
        with connection.cursor() as cursor:
            cursor.execute(SELECT_REQUEST_DETAILS, (request_id,))
            result = string_to_tuple(cursor.fetchone()[0])
            (
                id,
                date,
                project_id,
                db_id,
                org_admin_id,
                data_collection_start_date,
                data_collection_end_date,
                data_participants_num,
                data_description,
                data_keywords,
                additional_info,
            ) = result

            cursor.execute(f"SELECT * FROM public.project WHERE id = {project_id}")
            project_info = cursor.fetchone()

            request_details = {
                "request": {
                    "Request ID": id,
                    "Request Date": date,

                },
                "data": {
                    "Data Collection Start Date": data_collection_start_date,
                    "Data Collection End Date": data_collection_end_date,
                    "Participants Number": data_participants_num,
                    "Data Description": data_description,
                    "Data Keywords": data_keywords,
                },
                "project": {
                    "Name": project_info[1],
                    "Project Start Date": project_info[2],
                    "Project End Date": project_info[3],
                    "Project Lead": project_info[4],
                    "Project Members": project_info[5],
                    "University": project_info[6],
                    "Faculty": project_info[7],
                    "Ethics ID": project_info[8],
                    "Project Description": project_info[9],
                },
                "Additional Info": additional_info,
            }

            if db_id != 0:
                cursor.execute(f"SELECT * FROM public.researcher_db WHERE id = {db_id}")
                db_info = cursor.fetchone()
                request_details["db"] = {
                    "Database Name": db_info[1],
                    "Database Type": db_info[2],
                }
            else:
                cursor.execute(
                    f"SELECT * FROM public.org_admin WHERE id = {org_admin_id}"
                )
                org_admin_info = cursor.fetchone()
                request_details["org_admin"] = {
                    "Organisation Admin Email": org_admin_info[1],
                }

            return json.dumps(request_details)


def string_to_tuple(data):
    elements = data.split(",")
    for i in range(len(elements)):
        if is_valid_date(elements[i]):
            date = "'" + elements[i] + "'"
            elements[i] = date
    modified = ",".join(elements)
    return ast.literal_eval(modified)


def is_valid_date(date_string):
    try:
        datetime.strptime(date_string, "%d/%m/%Y")
        return True
    except ValueError:
        return False
