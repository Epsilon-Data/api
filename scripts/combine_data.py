import sys
import subprocess
import yaml

def install_package(package):
    subprocess.check_call([sys.executable, "-m", "pip", "install", package])

def connect_to_db(db_details, table_names):
    default_type = 'postgresql+psycopg2'
    engine = create_engine(
        f'{default_type}://{db_details["username"]}:{db_details["password"]}@{db_details["host"]}:{db_details["port"]}/{db_details["database"]}'
    )
    
    dataframes = {}
    for table_name in table_names:
        query = f'SELECT * FROM {table_name} LIMIT 1'  # Fetch only 1 row to check if empty
        result = pd.read_sql(query, engine)
        if not result.empty:
            query = f'SELECT * FROM {table_name}'
            dataframes[table_name] = pd.read_sql(query, engine)
    
    return dataframes

def find_related_tables(table, foreign_keys, primary_keys):
    related = set()
    if table in foreign_keys:
        for fk in foreign_keys[table]:
            for related_table, pk in primary_keys.items():
                if fk in pk and related_table != table:
                    related.add(related_table)
    return related

def update_table_map(mapping, deleted_index):
    updated_mapping = {}
    for key, index in mapping.items():
        if index == deleted_index:
            continue
        elif index > deleted_index:
            updated_mapping[key] = index - 1
        else:
            updated_mapping[key] = index
    return updated_mapping

def combine_dataframes(db_details, table_names, foreign_keys, primary_keys):
    dataframes = connect_to_db(db_details, table_names)

    combined_dataframes = []
    processed_tables = set()
    table_map = {}

    while dataframes:
        table, df = dataframes.popitem()
        if table in processed_tables:
            continue
        related_tables = find_related_tables(table, foreign_keys, primary_keys)
        combined_df = df
        processed_tables.add(table)

        for related_table in related_tables:
            if related_table in dataframes:
                related_df = dataframes.pop(related_table)
                common_keys = set(primary_keys[related_table]) & set(foreign_keys.get(table, []))
                for key in common_keys:
                    combined_df = pd.merge(combined_df, related_df, on=key, how='inner')
                processed_tables.add(related_table)
            elif related_table in processed_tables:
                related_index = table_map[related_table]
                combined_df = pd.merge(combined_df, combined_dataframes[related_index], how='inner')
                del combined_dataframes[related_index]
                table_map = update_table_map(table_map, related_index)
        
        combined_dataframes.append(combined_df)

        df_index = len(combined_dataframes) - 1
        table_map[table] = df_index
        for related_table in related_tables:
            table_map[related_table] = df_index

    for table, df in dataframes.items():
        combined_dataframes.append(df)
        df_index = len(combined_dataframes) - 1
        table_map[table] = df_index
    
    return combined_dataframes, table_map

def main(yaml_file):
  with open(yaml_file, 'r') as file:
    args = yaml.safe_load(file)
    db_details = args['dbDetails']
    source_id = args['sourceId']
    table_names = args['tableNames']
    foreign_keys = args['foreignKeys']
    primary_keys = args['primaryKeys']
  
    combined = []
    
    combined, table_map = combine_dataframes(db_details, table_names, foreign_keys, primary_keys)
    
    combined_json = {f"{i}": df.to_json(orient='records') for i, df in enumerate(combined)}
    
    output_file = f'{source_id}-output.json'
    with open(output_file, 'w') as outfile:
        json.dump({
            "combined": combined_json,
            "tableMap": table_map
        }, outfile)
    
    print(output_file) 

if __name__ == "__main__":
  install_package("pandas")
  install_package("psycopg2")
  install_package("sqlalchemy")
  
  import json
  import pandas as pd
  import os
  import boto3
  from botocore.client import Config
  from sqlalchemy import create_engine
  
  main(sys.argv[1])