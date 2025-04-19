#!/bin/bash

ssh-keyscan gitlab.layerzerox.com >>"${HOME}"/.ssh/known_hosts &&
  known_hosts=$(sort <"${HOME}"/.ssh/known_hosts | uniq) &&
  echo "${known_hosts}" >"${HOME}"/.ssh/known_hosts

PROJECT_DIR=${HOME}/omniflix/studio_backend
if [[ ! -d ${PROJECT_DIR} ]]; then
  cd "${HOME}" &&
    git clone git@gitlab.layerzerox.com:omniflix/studio_backend.git
fi

cd "${PROJECT_DIR}" &&
  git stash &&
  git checkout development &&
  git pull origin development &&
  yarn
