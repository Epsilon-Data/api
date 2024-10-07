import os
import sys
import subprocess
import yaml
import re

conn_code  = """
options(repos = c(CRAN = 'http://cran.rstudio.com'))
# Install necessary packages (if not already installed)
install.packages("RPostgres")
install.packages("DBI")

# Load the packages
library(DBI)
library(RPostgres)

# Function to fuse two data frames
fuse_data_frames <- function(dfs) {{
  # Determine the maximum number of rows needed
  max_rows <- max(sapply(dfs, nrow))
  
  # Initialize an empty data frame with the correct number of columns
  total_cols <- sum(sapply(dfs, ncol))
  combined_df <- data.frame(matrix(ncol = total_cols, nrow = max_rows))
  
  # Set column names for the combined data frame
  colnames(combined_df) <- unlist(lapply(dfs, colnames))
  
  # Populate the combined data frame
  current_col <- 1
  for (df in dfs) {{
    num_cols <- ncol(df)
    for (i in 1:max_rows) {{
      if (i <= nrow(df)) {{
        combined_df[i, current_col:(current_col + num_cols - 1)] <- df[i, ]
      }} else {{
        combined_df[i, current_col:(current_col + num_cols - 1)] <- NA
      }}
    }}
    current_col <- current_col + num_cols
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

def gen_query_block(column_mapping):
  block = """"""
  
  columns_by_table = {}
  for node, columns in column_mapping.items():
      for column in columns:
          table = column['table']
          name = column['name']
          if table not in columns_by_table:
              columns_by_table[table] = []
          columns_by_table[table].append(name)
  
  for table, names in columns_by_table.items():
    columns_str = '", "'.join(names)
    table_var = table.replace('.', '_')
    block += f"{table_var} <- dbGetQuery(con, 'SELECT \"{columns_str}\" from {table}')\n"
    
  return block

def gen_df_block(column_mapping, script_mapping):
  block = []
  tables_by_node = {}
  for node, columns in column_mapping.items():
      tables = set()
      for column in columns:
          tables.add(column['table'])
      tables_by_node[node] = list(tables)

  for var, node in script_mapping.items():
      if node in tables_by_node:
          tables_str = ', '.join(tables_by_node[node]).replace('.', '_')
          block.append((var, f"{var} <- fuse_data_frames(list({tables_str}))\n"))

  return block

def detect_libraries(script_lines):
    library_pattern = re.compile(r'^\s*library\((\w+)\)')
    require_pattern = re.compile(r'^\s*require\((\w+)\)')
    
    libraries = set()
    for line in script_lines:
        lib_match = library_pattern.search(line)
        req_match = require_pattern.search(line)
        if lib_match:
            libraries.add(lib_match.group(1))
        elif req_match:
            libraries.add(req_match.group(1))
    
    return libraries
  
def gen_install_packages_block(libraries):
    install_lines = [f"if (!require('{lib}')) install.packages('{lib}', dependencies=TRUE)" for lib in libraries]
    return '\n'.join(install_lines)

def prepend_script(source_details, csv_columns, script_mapping, script_path):
  conn_block = conn_code.format(name=source_details['name'], host=source_details['host'], port=source_details['port'], username=source_details['username'], password=source_details['password'])
  query_block = gen_query_block(csv_columns)
  df_block = gen_df_block(csv_columns, script_mapping)

  
  with open(script_path, 'r') as f:
    script_lines = f.readlines()
  
  libraries = detect_libraries(script_lines)
  install_block = gen_install_packages_block(libraries)
  
  for i, line in enumerate(script_lines):
    for var, new_line in df_block:
        if re.search(rf'{var}\s*<-\s*read\.csv|read_csv|read\.csv2', line):
            script_lines[i] = new_line
            break
  
  prepend_item = f"{install_block}\n{conn_block}\n{query_block}\n"
  
  combined = prepend_item + ''.join(script_lines)
  
  with open(script_path, 'w') as f:
    f.write(combined)

def upload_to_s3(file_path, prefix, file_name):
  bucket = "script"
  uri = os.getenv('S3_URI')
  s3 = boto3.client('s3',
                    endpoint_url=uri if uri else os.getenv('S3_URI'),
                    aws_access_key_id='admin',
                    aws_secret_access_key='supersecret',
                    config=Config(signature_version='s3v4'),)
  try:
      s3.upload_file(file_path, bucket, f'{prefix}/{file_name}')

      # Clean up the file after uploading
      if os.path.exists(file_path):
          os.remove(file_path)

  except Exception as e:
      print(f"Error occurred: {e}")

def get_from_s3(file_name, prefix, download_path):
  bucket = "script"
  uri = os.getenv('S3_URI')
  s3 = boto3.client('s3',
                    endpoint_url= uri if uri else os.getenv('S3_URI'),
                    aws_access_key_id='admin',
                    aws_secret_access_key='supersecret',
                    config=Config(signature_version='s3v4'),)
  try:
    os.makedirs(os.path.dirname(download_path), exist_ok=True)
    s3.download_file(bucket, f'{prefix}/{file_name}', download_path)

  except Exception as e:
      print(f"Error occurred: {e}")

def main(yaml_file):
  with open(yaml_file, 'r') as file:
    args = yaml.safe_load(file)
    db_details = args['dbDetails']
    analysis_id = args['analysisId']
    script_details = args['scriptDetails']
    csv_cols = args['csvColumns']
    
    script_path = f'{os.getcwd()}/temp_files/{script_details["id"]}.R'
  
    get_from_s3(f'{script_details["name"]}', analysis_id, script_path)
    prepend_script(db_details, csv_cols, script_details["mapping"], script_path)
    upload_to_s3(script_path, analysis_id, f'prepend-{script_details["name"]}')

if __name__ == "__main__":
  install_package("boto3")
  install_package("python-dotenv")
  
  import boto3
  from botocore.client import Config
  from dotenv import load_dotenv
  
  load_dotenv()
  
  main(sys.argv[1])