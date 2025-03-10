import sys
import subprocess
import warnings
import yaml

def install_package(package):
    subprocess.check_call([sys.executable, "-m", "pip", "install", package])

def categorize_variables(df, threshold=10):
    numerical_vars = df.select_dtypes(include=['number']).columns.tolist()
    categorical_vars = df.select_dtypes(include=['object', 'category']).columns.tolist()
    # Check for date-like columns in object or category columns
    potential_date_vars = []
    for col in categorical_vars:
        try:
          sample = df[col].sample(min(20, len(df)))
          with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            temp = pd.to_datetime(sample, errors='coerce', utc=True)
          if temp.notna().all():
              potential_date_vars.append(col)
        except:
          continue
    
    numerical_categoricals = []
    for col in numerical_vars:
        unique_values = df[col].nunique()
        if unique_values <= threshold:
            numerical_categoricals.append(col)
    
    numerical_vars = [col for col in numerical_vars if col not in numerical_categoricals]
    categorical_vars.extend(numerical_categoricals)

    return numerical_vars, categorical_vars, potential_date_vars

def censor_string(value):
    return ''.join([char if random.random() > 0.5 else 'x' for char in value])

def synthesis(df, synth_file, prefix, uri, key_id, secret_key, threshold=10):
  numerical_vars, categorical_vars, potential_date_vars = categorize_variables(df, threshold=threshold)

  df_syn = pd.DataFrame()
  rows = 200

  new_col_data = {}
  for col in numerical_vars:
      mean = df[col].mean()
      std = df[col].std()
      min_val = df[col].min()
      max_val = df[col].max()
      num_string = str(df[col].dropna().iloc[0])
      decimal_places = len(num_string.split('.')[1]) if '.' in num_string and num_string.split('.')[1] != '0' else 0
      null_ratio = df[col].isnull().mean()
      
      col_data = np.random.normal(mean, std, rows)
      col_data = np.clip(col_data, min_val, max_val)
      col_data = np.round(col_data, decimal_places)
      
      col_data[np.random.rand(rows) < null_ratio] = np.nan
      new_col_data[col] = col_data

  for col in categorical_vars:
    col_data = []
      
    null_ratio = df[col].isnull().mean()
    
    if df[col].dropna().size > 0:
        unique_values = df[col].dropna().unique()
        
        if len(unique_values) > threshold and (col not in potential_date_vars):
          col_data = [censor_string(str(val)) for val in np.random.choice(unique_values, rows)]
        else:
            col_data = np.random.choice(unique_values, rows)
            
    else:
        col_data = np.array([None] * rows) 
    
    if pd.api.types.is_numeric_dtype(df[col]):
        col_data = pd.Series(col_data)
        col_data[np.random.rand(rows) < null_ratio] = pd.NA
        
    else:
        col_data = np.array(col_data)
        col_data[np.random.rand(rows) < null_ratio] = ''
    
    new_col_data[col] = col_data
  
  # Combine all new columns at once  
  df_syn = pd.concat([df_syn, pd.DataFrame(new_col_data)], axis=1)
  
  csv_file = f"{synth_file}.csv"
  
  df_syn.to_csv(csv_file, index=False)
  
  upload_to_s3(csv_file, prefix, uri, key_id, secret_key)

def upload_to_s3(file_path, prefix, uri, key_id, secret_key):
  bucket = "synthetic"
  
  s3 = boto3.client('s3',
                    endpoint_url=uri,
                    aws_access_key_id=key_id,
                    aws_secret_access_key=secret_key,
                    config=Config(signature_version='s3v4'),)
  try:
      s3.upload_file(file_path, bucket, f'{prefix}/{file_path}')

      # Clean up the file after uploading
      if os.path.exists(file_path):
          os.remove(file_path)

  except Exception as e:
      print(f"Error occurred: {e}")


def main(yaml_file):
  with open(yaml_file, 'r') as file:
    args = yaml.safe_load(file)
    db_details = args['dbDetails']
    source_id = args['sourceId']
    table_names = args['tableNames']
    foreign_keys = args['foreignKeys']
    primary_keys = args['primaryKeys']
    uri = args['uri']
    key_id = args['keyId']
    secret_key = args['secretKey']
  
    combined = []
    
    combined, table_map = combine_dataframes(db_details, table_names, foreign_keys, primary_keys)
    
    output_json ='mapping.json'
  
    with open(output_json, 'w') as f:
        json.dump(table_map, f)
    
    upload_to_s3(output_json, source_id, uri, key_id, secret_key)
  
    if len(combined) > 0:
      for i in range(len(combined)):
        df = combined[i]
        synthesis(df, f'synth-{i}', source_id, uri, key_id, secret_key)
  
if __name__ == "__main__":
  install_package("pandas")
  install_package("psycopg2")
  install_package("sqlalchemy")
  install_package("boto3")
  install_package("python-dotenv")
  
  import json
  import pandas as pd
  import numpy as np
  import os
  import random
  import boto3
  from botocore.client import Config
  from combine_data import combine_dataframes
  
  main(sys.argv[1])