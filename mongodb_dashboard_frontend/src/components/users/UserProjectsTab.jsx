import React from 'react';
import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { getUserProjectsWithNames } from '../../api/userProjects';
import UserProjectsTable from './UserProjectsTable';
import useCurrentOrgId from '../../hooks/useCurrentOrgId';

/**
 * Tab content to show a user's project list with resolved names.
 */
export default function UserProjectsTab({ user }) {
  const organizationId = useCurrentOrgId();
  const [state, setState] = useState({ loading: true, error: null, items: [] });

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!user?._id && !user?.id) {
        setState({ loading: false, error: 'Missing user id', items: [] });
        return;
      }
      try {
        setState((s) => ({ ...s, loading: true, error: null }));
        const userId = String(user._id ?? user.id);
        const data = await getUserProjectsWithNames({
          userId,
          organizationId,
        });
        if (!mounted) return;
        setState({ loading: false, error: null, items: data.projects || [] });
      } catch (e) {
        if (!mounted) return;
        setState({ loading: false, error: e?.message || String(e), items: [] });
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [user?._id, user?.id, organizationId]);

  return <UserProjectsTable items={state.items} loading={state.loading} error={state.error} />;
}

UserProjectsTab.propTypes = {
  user: PropTypes.object.isRequired,
};
