# Project Comparison using UI

1. [Step By Step Process](project-comparison-using-ui.md#id-1.-step-by-step-process)
2. [Demo Video](project-comparison-using-ui.md#id-2.-demo-video)

## 1. Step By Step Process

## Project Schemas

Project Schemas are predefined templates used to create VC documents. These schemas are selected for a specific policy and serve as the structural basis for generating project data.

<figure><img src="../../../.gitbook/assets/image (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1).png" alt=""><figcaption></figcaption></figure>

In the current schema setup, specific ‘property fields’ are explicitly designated for the comparison process. These fields play a crucial role in evaluating and contrasting different projects.

<figure><img src="../../../.gitbook/assets/image (407).png" alt=""><figcaption></figcaption></figure>

These property fields were incorporated into the database as part of migration v.2-17-0, utilizing the 'policy-properties.csv' file. This integration ensures that the comparison process is seamless and data-driven.

## Project Overview

This section includes both category and policy filters, allowing users to sift through projects based on specific criteria.

<figure><img src="../../../.gitbook/assets/image (408).png" alt=""><figcaption></figcaption></figure>

### Filter Logic

Within a single group, filters apply a logical 'OR' to search for relevant projects. Between different groups, a logical 'AND' is used. This dual logic ensures a comprehensive filtering process.

### Search Enhancement

The functionality is further expanded by enabling searches based on project titles.

<figure><img src="../../../.gitbook/assets/image (3) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1).png" alt=""><figcaption></figcaption></figure>

### Result Dashboard

Users are presented with a dashboard showcasing projects that align with their chosen filters.

### Project Selection for Comparison

Users can select multiple projects for a side-by-side comparison by clicking the 'plus' button. After selection, accessing the 'open the comparison' button redirects them to a detailed comparison view.

### Projects Comparison Page

On this page, users will find a comparative table displaying selected project fields. This visual representation allows for an easy and intuitive comparison of different projects, highlighting similarities and differences.

<figure><img src="../../../.gitbook/assets/image (4) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1).png" alt=""><figcaption></figcaption></figure>

### VP Document Comparison

Document comparison includes examination of the VP documents generated by both projects. This works in the same way as comparing documents from the UI.

<figure><img src="../../../.gitbook/assets/image (619).png" alt=""><figcaption></figcaption></figure>

## 2. Demo Video

[Youtube](https://youtu.be/nw4PFCfVciM)
