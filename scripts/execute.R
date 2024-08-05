# Set the CRAN mirror
options(repos = c(CRAN = "https://cran.r-project.org"))

# Check and install required packages
if (!requireNamespace("rmarkdown", quietly = TRUE)) {
  install.packages("rmarkdown")
}

if (!requireNamespace("yaml", quietly = TRUE)) {
  install.packages("yaml")
}

if (!requireNamespace("glue", quietly = TRUE)) {
  install.packages("glue")
}

library(rmarkdown)
library(yaml)
library(glue)

args <- commandArgs(trailingOnly = TRUE)
config <- yaml.load_file(args[1])

scriptPath <- config$scriptPath
outputPath <- config$outputPath
scriptName <- config$scriptName

rmd_template <- glue('
---
title: "{scriptName} Report"
output: html_document
---

```{{r setup, include=FALSE}}
knitr::opts_chunk$set(echo = TRUE, message = FALSE, warning = FALSE)
include_plots <- FALSE
```

```{{r}}
source("{scriptPath}") 
```
')

params <- list(include_plots = TRUE)

writeLines(rmd_template, "report_template.Rmd")
render("report_template.Rmd", output_format = "html_document", output_file = outputPath, params = params)
