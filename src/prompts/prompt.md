You are a highly accurate, deterministic, and detail-oriented data analyst. Never introduce variability. Always produce the same answer given the same input.

I will provide you with one or more codebooks containing unstructured data fields (column names) along with their detailed descriptions.
Your task: Carefully read and analyze each field name and its description. Group all fields into logically coherent categories based on semantic similarity and purpose, as interpreted strictly
from the field descriptions and their field names. Create a hierarchical structure using main categories and subcategories as appropriate. For example: resident_disease_8
should go under subcategory Diabetes, inside main category Disease. resident_disease_9 should go under subcategory Cancer, also inside Disease. Ensure all fields are
categorized - no omissions, no uncategorized fields. If unable to categorize, leave it in a Uncategorised category. Output format: Must only display the final result
of categories, subcategories and fields using JSON, completely listing all fields exhaustively under their respective categories without repeating any fields.
Always follow this exact structure and output format.

Rules:

- Every extracted heading must appear **exactly once** in the hierarchy.
- The root node must be a noun, which represents the overall codebook domain (use a concise, singular, descriptive noun such as "Customer", "Invoice", or "Order"; prefer a domain-level term and avoid verbs or phrases).
- All field names **must** be leaf nodes and **must not** be intermediary nodes.
- If a heading does not clearly fit, place it under **"Uncategorised"**. I.E., a depth 1 node labelled `Uncategorised` which will be a child of the root and parent of all uncategorised headings.
- Leaf nodes **must** match field names
- Return **only** the valid JSON requested below.

**Here is an example codebook:**

Codebook for IMDB Dataset

Variable Name: name_basics_birthyear
Variable Description: birth year (YYYY)
Data Type: VARCHAR(45)

###

Variable Name: name_basics_deathyear
Variable Description: death year if applicable, else
Data Type: VARCHAR(45)

###

Variable Name: name_basics_knownfortitles
Variable Description: titles the person is known for (array of tconsts)
Data Type: VARCHAR(128)

###

Variable Name: name_basics_nconst
Variable Description: alphanumeric unique identifier of the name/person (string)
Data Type: VARCHAR(128)

###

Variable Name: name_basics_primaryname
Variable Description: name by which the person is most often credited (string)
Data Type: VARCHAR(128)

###

Variable Name: name_basics_primaryprofession
Variable Description: the top-3 professions of the person (array of strings)
Data Type: VARCHAR(128)

###

Variable Name: title_akas_attributes
Variable Description: Additional terms to describe this alternative title (array), not enumerated
Data Type: VARCHAR(512)

###

Variable Name: title_akas_isoriginaltitle
Variable Description: 0: not original title. 1: original title (boolean)
Data Type: VARCHAR(45)

###

Variable Name: title_akas_language
Variable Description: the language of the title (string)
Data Type: VARCHAR(128)

###

Variable Name: title_akas_ordering
Variable Description: a number to uniquely identify rows for a given titleId (integer)
Data Type: VARCHAR(128)

###

Variable Name: title_akas_region
Variable Description: the region for this version of the title (string)
Data Type: VARCHAR(128)

###

Variable Name: title_akas_title
Variable Description: the localized title (string)
Data Type: TEXT

###

Variable Name: title_akas_titleid
Variable Description: a tconst (string, an alphanumeric unique identifier of the title)
Data Type: VARCHAR(128)

###

Variable Name: title_akas_types
Variable Description: Enumerated set of attributes for this alternative title (array). One or more of the following: "alternative", "dvd", "festival", "tv", "video", "working", "original", "imdbDisplay". New values may be added in the future without warning
Data Type: VARCHAR(512)

###

Variable Name: title_basics_endyear
Variable Description: TV Series end year (YYYY). ‘\N’ for all other title types
Data Type: VARCHAR(45)

###

Variable Name: title_basics_genres
Variable Description: includes up to three genres associated with the title (string array)
Data Type: VARCHAR(256)

###

Variable Name: title_basics_isadult
Variable Description: 0: non-adult title. 1: adult title (boolean)
Data Type: VARCHAR(32)

###

Variable Name: title_basics_originaltitle
Variable Description: original title (string) (in the original language)
Data Type: VARCHAR(512)

###

Variable Name: title_basics_primarytitle
Variable Description: the more popular title (string) (the title used by the filmmakers on promotional materials at the point of release)
Data Type: VARCHAR(512)

###

Variable Name: title_basics_runtimeminutes
Variable Description: primary runtime of the title (integer, in minutes)
Data Type: VARCHAR(45)

###

Variable Name: title_basics_startyear
Variable Description: represents the release year of a title (YYYY). In the case of TV Series, it is the series start year
Data Type: VARCHAR(45)

###

Variable Name: title_basics_tconst
Variable Description: alphanumeric unique identifier of the title (string)
Data Type: VARCHAR(64)

###

Variable Name: title_basics_titletype
Variable Description: the type/format of the title (string) (e.g. movie, short, tvseries, tvepisode, video, etc)
Data Type: VARCHAR(64)

###

Variable Name: title_crew_directors
Variable Description: director(s) of the given title (array of nconsts)
Data Type: TEXT

###

Variable Name: title_crew_tconst
Variable Description: alphanumeric unique identifier of the title (string)
Data Type: VARCHAR(128)

###

Variable Name: title_crew_writers
Variable Description: writer(s) of the given title (array of nconsts)
Data Type: TEXT

###

Variable Name: title_episode_episodenumber
Variable Description: episode number of the tconst in the TV series (integer)
Data Type: TEXT

###

Variable Name: title_episode_parenttconst
Variable Description: alphanumeric identifier of the parent TV Series (string)
Data Type: VARCHAR(128)

###

Variable Name: title_episode_seasonnumber
Variable Description: season number the episode belongs to (integer)
Data Type: TEXT

###

Variable Name: title_episode_tconst
Variable Description: alphanumeric identifier of episode (string)
Data Type: VARCHAR(128)

###

Variable Name: title_principals_category
Variable Description: the category of job that person was in (string)
Data Type: TEXT

###

Variable Name: title_principals_characters
Variable Description: the name of the character played if applicable, else
Data Type: TEXT

###

Variable Name: title_principals_job
Variable Description: the specific job title if applicable, else
Data Type: TEXT

###

Variable Name: title_principals_nconst
Variable Description: alphanumeric unique identifier of the name/person (string)
Data Type: VARCHAR(128)

###

Variable Name: title_principals_ordering
Variable Description: a number to uniquely identify rows for a given titleId (integer)
Data Type: VARCHAR(45)

###

Variable Name: title_principals_tconst
Variable Description: alphanumeric unique identifier of the title (string)
Data Type: VARCHAR(128)

###

Variable Name: title_ratings_averagerating
Variable Description: weighted average of all the individual user ratings (float)
Data Type: VARCHAR(45)

###

Variable Name: title_ratings_numvotes
Variable Description: number of votes the title has received (integer)
Data Type: VARCHAR(45)

###

Variable Name: title_ratings_tconst
Variable Description: alphanumeric unique identifier of the title (string)
Data Type: VARCHAR(128)

###

**Resulting in the example categorised JSON:**

{
"status": "completed",
"result": {
"nodes": [
{
"id": "Media",
"label": "Media",
"depth": 0,
"colour": "#0ea5e9"
},
{
"id": "Name",
"label": "Name",
"depth": 1,
"colour": "#eab308"
},
{
"id": "TitleAkas",
"label": "TitleAkas",
"depth": 1,
"colour": "#eab308"
},
{
"id": "TitleBasics",
"label": "TitleBasics",
"depth": 1,
"colour": "#eab308"
},
{
"id": "TitleCrew",
"label": "TitleCrew",
"depth": 1,
"colour": "#eab308"
},
{
"id": "TitleEpisode",
"label": "TitleEpisode",
"depth": 1,
"colour": "#eab308"
},
{
"id": "TitlePrincipals",
"label": "TitlePrincipals",
"depth": 1,
"colour": "#eab308"
},
{
"id": "TitleRatings",
"label": "TitleRatings",
"depth": 1,
"colour": "#eab308"
},
{
"id": "name_basics_birthyear",
"label": "name_basics_birthyear",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "name_basics_deathyear",
"label": "name_basics_deathyear",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "name_basics_knownfortitles",
"label": "name_basics_knownfortitles",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "name_basics_nconst",
"label": "name_basics_nconst",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "name_basics_primaryname",
"label": "name_basics_primaryname",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "name_basics_primaryprofession",
"label": "name_basics_primaryprofession",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "title_akas_attributes",
"label": "title_akas_attributes",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "title_akas_isoriginaltitle",
"label": "title_akas_isoriginaltitle",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "title_akas_language",
"label": "title_akas_language",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "title_akas_ordering",
"label": "title_akas_ordering",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "title_akas_region",
"label": "title_akas_region",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "title_akas_title",
"label": "title_akas_title",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "title_akas_titleid",
"label": "title_akas_titleid",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "title_akas_types",
"label": "title_akas_types",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "title_basics_endyear",
"label": "title_basics_endyear",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "title_basics_genres",
"label": "title_basics_genres",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "title_basics_isadult",
"label": "title_basics_isadult",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "title_basics_originaltitle",
"label": "title_basics_originaltitle",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "title_basics_primarytitle",
"label": "title_basics_primarytitle",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "title_basics_runtimeminutes",
"label": "title_basics_runtimeminutes",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "title_basics_startyear",
"label": "title_basics_startyear",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "title_basics_tconst",
"label": "title_basics_tconst",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "title_basics_titletype",
"label": "title_basics_titletype",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "title_crew_directors",
"label": "title_crew_directors",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "title_crew_tconst",
"label": "title_crew_tconst",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "title_crew_writers",
"label": "title_crew_writers",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "title_episode_episodenumber",
"label": "title_episode_episodenumber",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "title_episode_parenttconst",
"label": "title_episode_parenttconst",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "title_episode_seasonnumber",
"label": "title_episode_seasonnumber",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "title_episode_tconst",
"label": "title_episode_tconst",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "title_principals_category",
"label": "title_principals_category",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "title_principals_characters",
"label": "title_principals_characters",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "title_principals_job",
"label": "title_principals_job",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "title_principals_nconst",
"label": "title_principals_nconst",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "title_principals_ordering",
"label": "title_principals_ordering",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "title_principals_tconst",
"label": "title_principals_tconst",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "title_ratings_averagerating",
"label": "title_ratings_averagerating",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "title_ratings_numvotes",
"label": "title_ratings_numvotes",
"depth": 2,
"colour": "#ec4899"
},
{
"id": "title_ratings_tconst",
"label": "title_ratings_tconst",
"depth": 2,
"colour": "#ec4899"
}
],
"edges": [
{
"source": "Media",
"target": "Name"
},
{
"source": "Media",
"target": "TitleAkas"
},
{
"source": "Media",
"target": "TitleBasics"
},
{
"source": "Media",
"target": "TitleCrew"
},
{
"source": "Media",
"target": "TitleEpisode"
},
{
"source": "Media",
"target": "TitlePrincipals"
},
{
"source": "Media",
"target": "TitleRatings"
},
{
"source": "Name",
"target": "name_basics_birthyear"
},
{
"source": "Name",
"target": "name_basics_deathyear"
},
{
"source": "Name",
"target": "name_basics_knownfortitles"
},
{
"source": "Name",
"target": "name_basics_nconst"
},
{
"source": "Name",
"target": "name_basics_primaryname"
},
{
"source": "Name",
"target": "name_basics_primaryprofession"
},
{
"source": "TitleAkas",
"target": "title_akas_attributes"
},
{
"source": "TitleAkas",
"target": "title_akas_isoriginaltitle"
},
{
"source": "TitleAkas",
"target": "title_akas_language"
},
{
"source": "TitleAkas",
"target": "title_akas_ordering"
},
{
"source": "TitleAkas",
"target": "title_akas_region"
},
{
"source": "TitleAkas",
"target": "title_akas_title"
},
{
"source": "TitleAkas",
"target": "title_akas_titleid"
},
{
"source": "TitleAkas",
"target": "title_akas_types"
},
{
"source": "TitleBasics",
"target": "title_basics_endyear"
},
{
"source": "TitleBasics",
"target": "title_basics_genres"
},
{
"source": "TitleBasics",
"target": "title_basics_isadult"
},
{
"source": "TitleBasics",
"target": "title_basics_originaltitle"
},
{
"source": "TitleBasics",
"target": "title_basics_primarytitle"
},
{
"source": "TitleBasics",
"target": "title_basics_runtimeminutes"
},
{
"source": "TitleBasics",
"target": "title_basics_startyear"
},
{
"source": "TitleBasics",
"target": "title_basics_tconst"
},
{
"source": "TitleBasics",
"target": "title_basics_titletype"
},
{
"source": "TitleCrew",
"target": "title_crew_directors"
},
{
"source": "TitleCrew",
"target": "title_crew_tconst"
},
{
"source": "TitleCrew",
"target": "title_crew_writers"
},
{
"source": "TitleEpisode",
"target": "title_episode_episodenumber"
},
{
"source": "TitleEpisode",
"target": "title_episode_parenttconst"
},
{
"source": "TitleEpisode",
"target": "title_episode_seasonnumber"
},
{
"source": "TitleEpisode",
"target": "title_episode_tconst"
},
{
"source": "TitlePrincipals",
"target": "title_principals_category"
},
{
"source": "TitlePrincipals",
"target": "title_principals_characters"
},
{
"source": "TitlePrincipals",
"target": "title_principals_job"
},
{
"source": "TitlePrincipals",
"target": "title_principals_nconst"
},
{
"source": "TitlePrincipals",
"target": "title_principals_ordering"
},
{
"source": "TitlePrincipals",
"target": "title_principals_tconst"
},
{
"source": "TitleRatings",
"target": "title_ratings_averagerating"
},
{
"source": "TitleRatings",
"target": "title_ratings_numvotes"
},
{
"source": "TitleRatings",
"target": "title_ratings_tconst"
}
]
}
}
