import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../../index';
import { IProject, selectProjectsList, setActiveProject, showActiveProjectFromList } from './projectsListSlice';

const ProjectsList = () => {
  const { t } = useTranslation();

  const listProjects = useAppSelector(selectProjectsList);
  const dispatch = useAppDispatch();

  const toggleShowActiveProjectFromList = (project: IProject): void => {
    dispatch(showActiveProjectFromList());
    dispatch(setActiveProject(project));
  };

  return (
    <>
      <ul className="list-group list-group-flush">
        {listProjects.map((project, index) => (
          <li
            key={index}
            className="list-group-item pt-2 pb-2 text-capitalize"
            onClick={() => toggleShowActiveProjectFromList(project)}
          >
            {t(project.ProjectName)}
          </li>
        ))}
      </ul>
    </>
  );
};

export default ProjectsList;
