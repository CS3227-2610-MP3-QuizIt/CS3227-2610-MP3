# Project Description

In this project, you will develop a production-level, AI-infused, secured web app using Spec-Driven Development (SDD) and Basic Multi-Agentic SE features as part of the software development process.

The setting of the app should be similar to MP2 (i.e., an app with multiple user roles for a formal setting) with the following additional requirements:

- There should be at least one LLM-based AI feature for each role.
- Spec-Driven Development and Basic Multi-Agent SE features should be followed in the development process.
- Explicit implementation and testing of security features for the AI features developed and in the development process are required.
- The app should be deployed online and there should be proper separation between the development and the production environment.

The user interface should be kept simple and separate for each user role. All shared components (e.g., data storage) should be properly designed (e.g., with SRP and DRY).

It is up to you to define the exact features for each user role.

However, in general, if there are N (= 2 or 3) students in your team, there should be N different user roles with the relevant features.

Each of the student should complete all the features related to a specific user role and a good portion of the work at the team-level. The estimate individual workload should be the same as the level of MP1.

In addition, as you work on the project, you should reflect on AI Security + SDD + Basic Multi-Agent SE and create a reflection document.

Here are some sample questions that you can use to guide your reflections.

## AI Security

- What are the different attack surfaces and different types of prompt injections that you have considered?
- What security features have been implemented and how are they tested?
- What limits have been applied to the AI agents?
- Did you make use of approval gates and human-oversight? How did you ensure that they are not compromised?

## Spec-Driven Development

- What should a good specification make clear before implementation begins?
- How can you tell whether a spec is precise enough for an agent to build from?
- How should changes to requirements flow through the spec, implementation, and tests?
- How can tests show that the software meets the intent of the spec, rather than only matching its wording?

## Basic Multi-Agent SE

- Which parts of a software task would benefit from specialized agents, such as an analyst, architect, developer, or tester?
- How to build and test the specialized agents well?
- What information must one agent pass to the next so that important context is not lost?
- If one agent writes the spec, another implements it, and a third reviews it, where could an error or malicious instruction slip through?
- What evidence should each agent leave behind so a person can verify its work?

# Restrictions

This is a team project (i.e., no individual submissions allowed). The team size is 2 or 3 students.

You are expected to focus on AI Security + SDD + Basic Multi-Agent SE (e.g., specialized agents) for your app and the development process.

You are allowed to reuse your MP2 as long as you properly quantify what has been reused.

You are allowed Codex / Claude for this MP.

The LLM used for supporting the AI features should be SoC LLM. You should pay attention to the restrictions (e.g., number of API calls allowed per minute), manage the use of such resources properly, and implement guardrails / error handling accordingly. For more information, please refer to: https://dochub.comp.nus.edu.sg/cf/guides/soclaas/start.

You might check out the existing SDD toolkits to get an idea of how SDD can be implemented. However, you should do SDD on your own (i.e., without using such toolkits for this MP).

In addition, you are NOT allowed to use any build-and-host environment (e.g., the ones available in Codex / Claude). Instead, the deployment should be managed separately by your team with suitable automations (e.g., via Github Actions).

You will be asked to redo the project if you violate such restrictions.

If you are unsure, please use the forum to clarify.

# Submission Instructions

For us to grade this assignment in a timely manner, we need you to adhere strictly to the following submission guidelines. They will help us grade the assignment in an appropriate manner. You will be penalized if you do not follow these instructions.

The repo should be named as CS3227-2610-MP3 in a github organization for you team and set to be public.

It should contain:

- Any source code (src/…). This folder should contain all the codes used in your project. The code will be reviewed for code quality. (Please format it nicely. We would really appreciate it.)
- Any files related to the Agentic SE workflow (workflow/…). All the files related to the development workflow (e.g., the .md files, the scripts for the graders) should be consolidated into this folder as much as possible unless it is reasonable / natural for them to be elsewhere. (Please organize the folder properly, and provide a brief description of all these files in the developer guide.)
- A user guide (docs/UserGuide.md). This should describe all current features of your system, and how the users can access and test your system. Ensure those descriptions match the product precisely, as it will be used by peer testers (inaccuracies will be considered bugs).
- A developer guide (docs/DeveloperGuide.md). This should describe the design of your system and the relevant software engineering process, with the focus on the additional requirements listed above. It should match the latest release of the product and include an acknowledgement section citing all ideas / code / documentation you have reused.
- A product website. This should be set up using Github pages as you have done in CS2103/T.
- A reflection document (docs/Reflections.md). This should contain your reflections on AI Reflection + SDD + Basic Multi-Agent SE. Give concrete examples for each of the topics.
- A folder of summary logs (logs/…). This folder should contain summaries of all the prompts and interactions that took place during the development of this app. Ask AI to produce the summaries for you, but don’t forget to verify the correctness of the generated summaries. (These summaries will come in handy when you reflect on your project.)

Make sure that your repo is named and structured as explained in this write up, and master branch is up to date. We will pull the latest version of your master branch before the deadline, which is 23 Oct (Fri), 2pm SGT, and use it for grading.

One member in your team should also submit your Github organization name through the relevant Canvas quiz by 9 Oct (Fri), 2pm SGT. (Note: The submission is still required even if the team formation is the same.)

There absolutely will be no extensions to the deadline of this assignment. Read the Grading page in Canvas if you are unsure about the late submission penalty.

In addition, we will also access your repo on Github during the grading process so please make sure that the repo is accessible and there are no further changes to it after your submission.