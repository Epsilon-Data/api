import sys
import json

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

def prepend_script(source_details, script_path):
  script = open(script_path, 'r').read()
  script = static_r_code.format(name=source_details['name'], host=source_details['host'], port=source_details['port'], username=source_details['username'], password=source_details['password']) + script
  with open(script_path, 'w') as f:
    f.write(script)

def main(args):
  if len(args) != 4:
    print("Usage: python process.py <r_script_path> <source_details_json> <column_mapping_json>")
    return

  script_path = args[1] 
  details_arg = args[2]
  
  
  try:
    source_details = json.loads(details_arg)
    prepend_script(source_details, script_path)

  except json.JSONDecodeError as e:
    print(f"Error parsing JSON: {e}")

if __name__ == "__main__":
    main(sys.argv)