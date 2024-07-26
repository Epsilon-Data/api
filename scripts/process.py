import os
import sys
import subprocess
import yaml

static_r_code  = """
# Install necessary packages (if not already installed)
#install.packages("RPostgres")
#install.packages("DBI")

# Load the packages
library(DBI)
library(RPostgres)

# Function to fuse two data frames
fuse_data_frames <- function(user_df, food_df) {{
  # Determine the maximum number of rows needed
  max_rows <- max(nrow(user_df), nrow(food_df))
  
  # Initialize an empty data frame with the correct number of columns
  combined_df <- data.frame(matrix(ncol = ncol(user_df) + ncol(food_df), nrow = max_rows))
  colnames(combined_df) <- c(colnames(user_df), colnames(food_df))
  
  # Populate the combined data frame
  for (i in 1:max_rows) {{
    if (i <= nrow(user_df)) {{
      combined_df[i, 1:ncol(user_df)] <- user_df[i, ]
    }} else {{
      combined_df[i, 1:ncol(user_df)] <- ""
    }}
    if (i <= nrow(food_df)) {{
      combined_df[i, (ncol(user_df) + 1):ncol(combined_df)] <- food_df[i, ]
    }} else {{
      combined_df[i, (ncol(user_df) + 1):ncol(combined_df)] <- ""
    }}
  }}
  
  return(combined_df)
}}

# Establish connection
con <- dbConnect(RPostgres::Postgres(),
                 dbname = "{name}",
                 host = "{host}",  # e.g., "localhost"
                 port = {port},         # Default PostgreSQL port
                 user = "{username}",
                 password = "{password}")

"""

def install_package(package):
    subprocess.check_call([sys.executable, "-m", "pip", "install", package])

def prepend_script(source_details, script_path):
  script = open(script_path, 'r').read()
  script = static_r_code.format(name=source_details['name'], host=source_details['host'], port=source_details['port'], username=source_details['username'], password=source_details['password']) + script
  with open(script_path, 'w') as f:
    f.write(script)

def upload_to_s3(file_path, prefix):
  bucket = "script"
  s3 = boto3.client('s3',
                    endpoint_url='http://localhost:9000',
                    aws_access_key_id='admin',
                    aws_secret_access_key='supersecret',
                    config=Config(signature_version='s3v4'),)
  try:
      s3.upload_file(file_path, bucket, f'{prefix}/{file_path}')

      # Clean up the file after uploading
      if os.path.exists(file_path):
          os.remove(file_path)

  except Exception as e:
      print(f"Error occurred: {e}")

def get_from_s3(file_path, prefix, download_path):
  bucket = "script"
  s3 = boto3.client('s3',
                    endpoint_url='http://localhost:9000',
                    aws_access_key_id='admin',
                    aws_secret_access_key='supersecret',
                    config=Config(signature_version='s3v4'),)
  try:
    s3.download_file(bucket, f'{prefix}/{file_path}', download_path)

  except Exception as e:
      print(f"Error occurred: {e}")

def main(yaml_file):
  with open(yaml_file, 'r') as file:
    args = yaml.safe_load(file)
    db_details = args['dbDetails']
    analysis_id = args['analysisId']
    script_details = args['scriptDetails']
    
    script_path = f'{script_details["id"]}.R'
  
    get_from_s3(f'{script_details["name"]}.R', analysis_id, script_path)
    prepend_script(db_details, script_path)

if __name__ == "__main__":
  install_package("boto3")
  
  import boto3
  from botocore.client import Config
  
  main(sys.argv[1])