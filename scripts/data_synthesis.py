import os
import sys
import subprocess
import json


def install_package(package):
    subprocess.check_call([sys.executable, "-m", "pip", "install", package])

def synthesis(df, filepath, index):
  from sdv.metadata import SingleTableMetadata
  from sdv.single_table import GaussianCopulaSynthesizer
  
  metadata = SingleTableMetadata()
  metadata.detect_from_dataframe(df)
  metadata.save_to_json(filepath=f"{filepath}/metadata_{index}.json")
  
  synthesizer = GaussianCopulaSynthesizer(metadata)
  synthesizer.fit(df)
  synthetic_data = synthesizer.sample(num_rows=200)
  synthetic_folder = f'{filepath}/synth'

  # Create the directory if it does not exist
  if not os.path.exists(synthetic_folder):
      os.makedirs(synthetic_folder)
  
  synthetic_data.to_csv(f"{synthetic_folder}/{index}.csv", index=False)
  

def combine_dataframes(csv_folder_path, table_names, foreign_keys, primary_keys):
  import pandas as pd
  
  # Load all CSV files
  dataframes = {}
  for table_name in table_names:
      file_path = os.path.join(csv_folder_path, table_name + '.csv')
      if os.path.exists(file_path):
          dataframes[table_name] = pd.read_csv(file_path)

  # Combine related CSVs
  combined_dataframes = []
  processed_tables = set()
  table_map = {}

  def find_related_tables(table, processed):
      related = set()
      if table in foreign_keys:
          for fk in foreign_keys[table]:
              for related_table, pk in primary_keys.items():
                  if fk in pk:
                      related.add(related_table)
      return related - processed
  
  def add_to_map(table, df_index):
    if table not in table_map:
        table_map[table] = df_index

  while dataframes:
      table, df = dataframes.popitem()
      if table in processed_tables:
          continue
      related_tables = find_related_tables(table, processed_tables)
      combined_df = df
      processed_tables.add(table)

      for related_table in related_tables:
          if related_table in dataframes:
              related_df = dataframes.pop(related_table)
              common_keys = set(primary_keys[related_table]) & set(foreign_keys.get(table, []))
              for key in common_keys:
                  combined_df = pd.merge(combined_df, related_df, on=key, how='inner')
              processed_tables.add(related_table)
      
      combined_dataframes.append(combined_df)
      
      df_index = len(combined_dataframes) - 1
      add_to_map(table, df_index)
      for related_table in related_tables:
          add_to_map(related_table, df_index)

  # Separate unrelated CSVs
  for table, df in dataframes.items():
      combined_dataframes.append(df)

  output_json = os.path.join(csv_folder_path, 'mapping.json')
  
  with open(output_json, 'w') as f:
    json.dump(table_map, f)

  return combined_dataframes

def main(args):
  if len(args) != 5:
    print("Usage: python data_synthesis.py <csv_folder_path> <table_names> <foreign_keys> <primary_keys> <>")
    return 
  
  csv_folder_path= args[1]
  table_names = args[2]
  foreign_keys = args[3]
  primary_keys = args[4]
  
  combined = []
  
  from sdv.datasets.local import load_csvs
  from sdv.datasets.demo import download_demo
  
  try:
    table_names = json.loads(table_names)
    foreign_keys = json.loads(foreign_keys)
    primary_keys = json.loads(primary_keys)
    combined = combine_dataframes(csv_folder_path, table_names, foreign_keys, primary_keys)
  except json.JSONDecodeError as e:
    print(f"Error parsing JSON: {e}")
    
  if len(combined) > 0:
    for i in range(len(combined)):
      df = combined[i]
      synthesis(df, csv_folder_path, i)
  
if __name__ == "__main__":
    install_package("sdv")
    install_package("pandas")
    main(sys.argv)